import { useCallback, useRef, useState } from 'react';
import type { DataConnection } from 'peerjs';
import {
  FILE_CHUNK_SIZE,
  MAX_FILE_SIZE_BYTES,
  type ClipboardMessage,
  type ControlMessage,
  type SessionPermissions,
  type TransferredFile,
} from '../types/session';
import {
  arrayBufferToBase64,
  base64ToUint8Array,
  generateNonce,
  sha256Hex,
} from '../utils/crypto';
import { appendAuditEntry } from '../utils/auditLog';

interface IncomingFileBuffer {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  expectedSha256: string;
  chunks: Array<Uint8Array | null>;
  receivedCount: number;
}

interface UseDataChannelTransferOptions {
  role: 'host' | 'viewer';
  permissionsRef: React.MutableRefObject<SessionPermissions>;
  dataConnRef: React.MutableRefObject<DataConnection | null>;
  sasVerifiedRef: React.MutableRefObject<boolean>;
}

/**
 * Shared handler for encrypted clipboard text and chunked SHA-256 verified
 * file transfer over a PeerJS WebRTC DataChannel.
 */
export function useDataChannelTransfer({
  role,
  permissionsRef,
  dataConnRef,
  sasVerifiedRef,
}: UseDataChannelTransferOptions) {
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardMessage[]>([]);
  const [files, setFiles] = useState<TransferredFile[]>([]);
  const [fileProgress, setFileProgress] = useState<{
    name: string;
    percent: number;
    direction: 'sending' | 'receiving';
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const incomingBuffersRef = useRef<Map<string, IncomingFileBuffer>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);

  /** Cleanup created Blob object URLs when session terminates. */
  const resetTransfers = useCallback(() => {
    incomingBuffersRef.current.clear();
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
    setClipboardHistory([]);
    setFiles([]);
    setFileProgress(null);
    setFileError(null);
  }, []);

  /** Send clipboard text over DataChannel when SAS is verified and permission is ON. */
  const sendClipboard = useCallback(
    (text: string) => {
      const conn = dataConnRef.current;
      if (!conn || !conn.open) return;
      if (!sasVerifiedRef.current || !permissionsRef.current.clipboard) return;

      const id = generateNonce(8);
      const timestamp = new Date().toISOString();
      const msg: ControlMessage = {
        type: 'clipboard-text',
        id,
        text,
        timestamp,
      };
      conn.send(msg);

      setClipboardHistory((prev) => [{ id, sender: role, text, timestamp }, ...prev]);
      void appendAuditEntry(
        'CLIPBOARD_SHARED',
        role,
        `Sent clipboard text (${text.length} chars)`
      );
    },
    [dataConnRef, permissionsRef, role, sasVerifiedRef]
  );

  /** Send a file in 16 KB chunks with SHA-256 integrity hash over DataChannel. */
  const sendFile = useCallback(
    async (file: File) => {
      setFileError(null);
      const conn = dataConnRef.current;
      if (!conn || !conn.open) return;
      if (!sasVerifiedRef.current || !permissionsRef.current.fileTransfer) return;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError('File exceeds 10 MB limit.');
        return;
      }

      const id = generateNonce(8);
      const arrayBuffer = await file.arrayBuffer();
      const digest = await sha256Hex(arrayBuffer);
      const totalChunks = Math.max(1, Math.ceil(arrayBuffer.byteLength / FILE_CHUNK_SIZE));

      const metaMsg: ControlMessage = {
        type: 'file-meta',
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
        sha256: digest,
      };
      conn.send(metaMsg);

      setFileProgress({ name: file.name, percent: 0, direction: 'sending' });

      for (let i = 0; i < totalChunks; i++) {
        // Abort cleanly if Host revokes permission or connection drops mid-transfer
        if (!conn.open || !permissionsRef.current.fileTransfer) {
          setFileProgress(null);
          return;
        }
        const start = i * FILE_CHUNK_SIZE;
        const end = Math.min(start + FILE_CHUNK_SIZE, arrayBuffer.byteLength);
        const slice = arrayBuffer.slice(start, end);

        const chunkMsg: ControlMessage = {
          type: 'file-chunk',
          id,
          chunkIndex: i,
          data: arrayBufferToBase64(slice),
        };
        conn.send(chunkMsg);

        // Yield periodically so UI progress updates smoothly and SCTP buffer drains
        if (i % 8 === 0) {
          setFileProgress({
            name: file.name,
            percent: Math.round(((i + 1) / totalChunks) * 100),
            direction: 'sending',
          });
          await new Promise((r) => window.setTimeout(r, 4));
        }
      }

      conn.send({ type: 'file-complete', id } satisfies ControlMessage);
      setFileProgress(null);

      setFiles((prev) => [
        {
          id,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          direction: 'sent',
          sha256: digest,
          verified: true,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      void appendAuditEntry(
        'FILE_TRANSFERRED',
        role,
        `Sent "${file.name}" (${file.size} bytes, SHA-256 ${digest.slice(0, 12)})`
      );
    },
    [dataConnRef, permissionsRef, role, sasVerifiedRef]
  );

  /** Handle incoming clipboard & file protocol messages from the remote peer. */
  const handleIncomingTransferMessage = useCallback(
    async (msg: ControlMessage) => {
      const conn = dataConnRef.current;

      if (msg.type === 'clipboard-text') {
        if (!sasVerifiedRef.current || !permissionsRef.current.clipboard) return;
        const remoteRole = role === 'host' ? 'viewer' : 'host';
        setClipboardHistory((prev) => [
          { id: msg.id, sender: remoteRole, text: msg.text, timestamp: msg.timestamp },
          ...prev,
        ]);
        void appendAuditEntry(
          'CLIPBOARD_SHARED',
          role,
          `Received clipboard text (${msg.text.length} chars)`
        );
        return;
      }

      if (msg.type === 'file-meta') {
        if (!sasVerifiedRef.current || !permissionsRef.current.fileTransfer) {
          conn?.send({ type: 'file-rejected', id: msg.id, reason: 'disabled' } satisfies ControlMessage);
          return;
        }
        if (msg.size > MAX_FILE_SIZE_BYTES) {
          conn?.send({ type: 'file-rejected', id: msg.id, reason: 'too-large' } satisfies ControlMessage);
          return;
        }
        incomingBuffersRef.current.set(msg.id, {
          id: msg.id,
          name: msg.name,
          size: msg.size,
          mimeType: msg.mimeType,
          totalChunks: msg.totalChunks,
          expectedSha256: msg.sha256,
          chunks: new Array(msg.totalChunks).fill(null),
          receivedCount: 0,
        });
        setFileProgress({ name: msg.name, percent: 0, direction: 'receiving' });
        return;
      }

      if (msg.type === 'file-chunk') {
        const buffer = incomingBuffersRef.current.get(msg.id);
        if (!buffer || !permissionsRef.current.fileTransfer) return;
        if (msg.chunkIndex >= 0 && msg.chunkIndex < buffer.totalChunks) {
          if (buffer.chunks[msg.chunkIndex] === null) {
            buffer.chunks[msg.chunkIndex] = base64ToUint8Array(msg.data);
            buffer.receivedCount += 1;
            setFileProgress({
              name: buffer.name,
              percent: Math.round((buffer.receivedCount / buffer.totalChunks) * 100),
              direction: 'receiving',
            });
          }
        }
        return;
      }

      if (msg.type === 'file-complete') {
        const buffer = incomingBuffersRef.current.get(msg.id);
        if (!buffer) return;
        incomingBuffersRef.current.delete(msg.id);
        setFileProgress(null);

        const validChunks = buffer.chunks.filter((c): c is Uint8Array => c !== null);
        const totalLength = validChunks.reduce((acc, c) => acc + c.byteLength, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of validChunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }

        const actualSha256 = await sha256Hex(merged);
        const verified = actualSha256 === buffer.expectedSha256;
        const blob = new Blob([merged], { type: buffer.mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        objectUrlsRef.current.push(downloadUrl);

        setFiles((prev) => [
          {
            id: buffer.id,
            name: buffer.name,
            size: merged.byteLength,
            mimeType: buffer.mimeType,
            direction: 'received',
            sha256: actualSha256,
            verified,
            timestamp: new Date().toISOString(),
            downloadUrl,
          },
          ...prev,
        ]);

        void appendAuditEntry(
          'FILE_TRANSFERRED',
          role,
          `Received "${buffer.name}" (${merged.byteLength} bytes, ${verified ? 'SHA-256 OK' : 'CHECKSUM MISMATCH'})`
        );
        return;
      }

      if (msg.type === 'file-rejected') {
        setFileProgress(null);
        setFileError(
          msg.reason === 'too-large'
            ? 'Remote peer rejected file: exceeds 10 MB limit.'
            : 'Remote peer rejected file: file transfer permission is OFF.'
        );
      }
    },
    [dataConnRef, permissionsRef, role, sasVerifiedRef]
  );

  return {
    clipboardHistory,
    files,
    fileProgress,
    fileError,
    sendClipboard,
    sendFile,
    handleIncomingTransferMessage,
    resetTransfers,
  };
}
