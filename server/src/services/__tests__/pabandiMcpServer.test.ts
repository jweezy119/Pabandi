import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import crypto from 'crypto';

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/pabandi';
});

import { callTool, dispatch, handleSubmitDisputeEvidence } from '../../mcp/pabandiMcpServer';
import { storageService } from '../storage.service';
import { prisma } from '../../utils/database';

describe('MCP File Uploads Extension & pabandi_submit_dispute_evidence', () => {
  const mockWorkOrderId = 'wo_dispute_test_999';

  beforeEach(() => {
    vi.clearAllMocks();
    storageService.clearMockStore();
    vi.spyOn(prisma.workOrder, 'findUnique').mockResolvedValue({
      id: mockWorkOrderId,
      businessId: 'biz_test_1',
    } as any);
  });

  it('advertises io.modelcontextprotocol/files extension in server discovery capabilities', async () => {
    // 1. Check initialize response
    const initResponse = await dispatch('initialize', {}, 1);
    expect(initResponse.result).toBeDefined();
    expect(initResponse.result.capabilities).toBeDefined();
    expect(initResponse.result.capabilities.extensions).toBeDefined();
    expect(
      initResponse.result.capabilities.extensions['io.modelcontextprotocol/files']
    ).toEqual({
      upload: {},
      maxInlineBytes: 1048576,
    });

    // 2. Check server/discover response
    const discoverResponse = await dispatch('server/discover', {}, 2);
    expect(discoverResponse.result.capabilities.extensions['io.modelcontextprotocol/files']).toEqual({
      upload: {},
      maxInlineBytes: 1048576,
    });
  });

  it('Test 1: Call the tool with inline base64 data. Assert it returns success and saves to Prisma', async () => {
    const rawFileContent = Buffer.from('Photographic evidence of damaged HVAC compressor on roof site.');
    const base64Data = rawFileContent.toString('base64');
    const expectedHash = crypto.createHash('sha256').update(rawFileContent).digest('hex');

    const prismaUpsertSpy = vi.spyOn(prisma.disputeEvidence, 'upsert').mockResolvedValue({
      id: 'disp_ev_01',
      workOrderId: mockWorkOrderId,
      fileId: 'file_inline_001',
      fileName: 'hvac_damage.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: rawFileContent.length,
      storageKey: `disputes/${mockWorkOrderId}/file_inline_001-hvac_damage.jpg`,
      vcapHash: expectedHash,
      uploadedAt: new Date(),
    } as any);

    const result = await callTool('pabandi_submit_dispute_evidence', {
      workOrderId: mockWorkOrderId,
      evidence: {
        id: 'file_inline_001',
        name: 'hvac_damage.jpg',
        mimeType: 'image/jpeg',
        size: rawFileContent.length,
        data: base64Data,
      },
    });

    // Assert tool returns success with vcapHash
    expect(result.success).toBe(true);
    expect(result.vcapHash).toBe(expectedHash);
    expect(result.content[0].text).toContain(`VCAP hash: ${expectedHash}`);

    // Assert saved to Prisma with correct metadata
    expect(prismaUpsertSpy).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaUpsertSpy.mock.calls[0][0];
    expect(upsertArgs.where.fileId).toBe('file_inline_001');
    expect(upsertArgs.create.workOrderId).toBe(mockWorkOrderId);
    expect(upsertArgs.create.fileName).toBe('hvac_damage.jpg');
    expect(upsertArgs.create.mimeType).toBe('image/jpeg');
    expect(upsertArgs.create.vcapHash).toBe(expectedHash);
    expect(upsertArgs.create.sizeBytes).toBe(rawFileContent.length);
  });

  it('Test 2: Call the tool without data. Assert it returns upload_required with a valid requestState', async () => {
    const result = await callTool('pabandi_submit_dispute_evidence', {
      workOrderId: mockWorkOrderId,
      evidence: {
        id: 'file_large_002',
        name: 'structural_report.pdf',
        mimeType: 'application/pdf',
        size: 5242880, // 5MB
      },
    });

    // Assert upload_required response structure
    expect(result.resultType).toBe('upload_required');
    expect(Array.isArray(result.uploads)).toBe(true);
    expect(result.uploads).toHaveLength(1);
    expect(result.uploads[0].fileId).toBe('file_large_002');
    expect(result.uploads[0].url).toContain('upload');
    expect(result.uploads[0].headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(result.uploads[0].credentials).toBe('omit');

    // Assert requestState signed token is returned
    expect(result.requestState).toBeDefined();
    expect(typeof result.requestState).toBe('string');
    expect(result.requestState.length).toBeGreaterThan(20);
  });

  it('Test 3: Call the tool with requestState from Test 2. Mock S3 existence check. Assert it saves to Prisma and returns success', async () => {
    // 1. Generate the initial metadata call to obtain requestState
    const initialCall = await callTool('pabandi_submit_dispute_evidence', {
      workOrderId: mockWorkOrderId,
      evidence: {
        id: 'file_large_003',
        name: 'engineer_inspection.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      },
    });

    const requestState = initialCall.requestState;
    expect(requestState).toBeDefined();

    // 2. Mock S3 object existence and payload
    const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock technical engineer evaluation report for Sulha arbitration.');
    const expectedVcapHash = crypto.createHash('sha256').update(mockPdfBuffer).digest('hex');

    const expectedStorageKey = `disputes/${mockWorkOrderId}/file_large_003-engineer_inspection.pdf`;

    // Populate mock storage with uploaded bytes
    storageService.setMockFile(expectedStorageKey, mockPdfBuffer, 'application/pdf');

    // Spy on S3 checkObjectExists
    const s3CheckSpy = vi.spyOn(storageService, 'checkObjectExists').mockResolvedValue({
      exists: true,
      size: mockPdfBuffer.length,
    });

    const s3DownloadSpy = vi.spyOn(storageService, 'getObjectBytes').mockResolvedValue(mockPdfBuffer);

    // Spy on Prisma upsert
    const prismaUpsertSpy = vi.spyOn(prisma.disputeEvidence, 'upsert').mockResolvedValue({
      id: 'disp_ev_03',
      workOrderId: mockWorkOrderId,
      fileId: 'file_large_003',
      fileName: 'engineer_inspection.pdf',
      mimeType: 'application/pdf',
      sizeBytes: mockPdfBuffer.length,
      storageKey: expectedStorageKey,
      vcapHash: expectedVcapHash,
      uploadedAt: new Date(),
    } as any);

    // 3. Second call with requestState
    const secondCall = await callTool('pabandi_submit_dispute_evidence', {
      workOrderId: mockWorkOrderId,
      evidence: {
        id: 'file_large_003',
        name: 'engineer_inspection.pdf',
        mimeType: 'application/pdf',
        size: mockPdfBuffer.length,
      },
      requestState,
    });

    // Assert S3 check was triggered
    expect(s3CheckSpy).toHaveBeenCalledWith(expectedStorageKey, mockPdfBuffer.length);
    expect(s3DownloadSpy).toHaveBeenCalledWith(expectedStorageKey);

    // Assert Prisma saved the record
    expect(prismaUpsertSpy).toHaveBeenCalledTimes(1);
    const savedRecord = prismaUpsertSpy.mock.calls[0][0];
    expect(savedRecord.where.fileId).toBe('file_large_003');
    expect(savedRecord.create.vcapHash).toBe(expectedVcapHash);
    expect(savedRecord.create.storageKey).toBe(expectedStorageKey);

    // Assert success result with download targets
    expect(secondCall.content[0].text).toContain(`Evidence attached. VCAP hash: ${expectedVcapHash}`);
    expect(secondCall._meta).toBeDefined();
    expect(secondCall._meta.downloadTargets).toHaveLength(1);
    expect(secondCall._meta.downloadTargets[0].fileId).toBe('file_large_003');
    expect(secondCall._meta.downloadTargets[0].url).toContain('download');
  });
});
