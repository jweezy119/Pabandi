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
        provider: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        managerId: string;
        confidence: number | null;
        latencyMs: number | null;
        documentType: string;
        fileName: string;
        fileUrl: string | null;
        textContent: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue;
        tokensUsed: number | null;
    }>;
    /**
     * Get analysis history for a manager
     */
    getHistory(managerId: string, limit?: number): Promise<{
        model: string | null;
        provider: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        id: string;
        createdAt: Date;
        managerId: string;
        confidence: number | null;
        latencyMs: number | null;
        documentType: string;
        fileName: string;
        fileUrl: string | null;
        textContent: string | null;
        analysis: import("@prisma/client/runtime/library").JsonValue;
        tokensUsed: number | null;
    }[]>;
}
export declare const documentAIService: DocumentAIService;
//# sourceMappingURL=documentAI.service.d.ts.map