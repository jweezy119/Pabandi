"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyDIDService = exports.PropertyDIDService = void 0;
const database_1 = require("../utils/database");
const vc_service_1 = require("./vc.service");
const client_1 = require("@prisma/client");
class PropertyDIDService {
    constructor() {
        this.vcService = new vc_service_1.VCService();
    }
    async registerProperty(landlordId, propertyData) {
        // 1. Create property record
        const property = await database_1.prisma.property.create({
            data: {
                landlordId,
                ...propertyData
            }
        });
        // 2. Assign DID
        const did = `did:web:pabandi.local:property:${property.id}`;
        await database_1.prisma.property.update({
            where: { id: property.id },
            data: { did }
        });
        // 3. Issue initial Title VC to the property
        const titleVC = await this.vcService.issuePropertyCredential(property.id, client_1.CredentialType.PROPERTY_TITLE, {
            address: property.address,
            city: property.city,
            state: property.state,
            landlordId
        });
        return { property: { ...property, did }, titleVC };
    }
    async issueInspectionCredential(propertyId, inspectorId, inspectionData) {
        const vc = await this.vcService.issuePropertyCredential(propertyId, client_1.CredentialType.INSPECTION_HISTORY, {
            inspectorId,
            inspectionDate: new Date().toISOString(),
            ...inspectionData
        });
        return vc;
    }
    async issueEnergyRatingCredential(propertyId, rating, validUntil) {
        const vc = await this.vcService.issuePropertyCredential(propertyId, client_1.CredentialType.ENERGY_RATING, {
            rating,
            validUntil
        });
        return vc;
    }
    async getPropertyCredentials(propertyId) {
        const credentials = await database_1.prisma.verifiableCredential.findMany({
            where: { propertyId, isRevoked: false },
            orderBy: { issuedAt: 'desc' }
        });
        return credentials;
    }
}
exports.PropertyDIDService = PropertyDIDService;
exports.propertyDIDService = new PropertyDIDService();
//# sourceMappingURL=property-did.service.js.map