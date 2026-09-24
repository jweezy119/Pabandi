export type DocumentAnalysisResult = {
    summary: string;
    keyEntities: {
        name: string;
        value: string;
    }[];
    risks: string[];
    suggestions: string[];
    confidence: number;
};
export declare class DocumentAIService {
    /**
     * Analyze a document using AI
     */
    analyzeDocument(managerId: string, fileName: string, textContent: string, documentType: string, fileUrl?: string): Promise<{
        model: string | null;
        id: string;
        createdAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        managerId: string;
        confidence: number | null;
        provider: string;
        latencyMs: number | null;
        tokensUsed: number | null;
        fileName: string;
        fileUrl: string | null;
        documentType: string;
        textContent: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue;
    }>;
    /**
     * Get analysis history for a manager
     */
    getHistory(managerId: string, limit?: number): Promise<{
        model: string | null;
        id: string;
        createdAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        managerId: string;
        confidence: number | null;
        provider: string;
        latencyMs: number | null;
        tokensUsed: number | null;
        fileName: string;
        fileUrl: string | null;
        documentType: string;
        textContent: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
}
export declare const documentAIService: DocumentAIService;
//# sourceMappingURL=documentAI.service.d.ts.map