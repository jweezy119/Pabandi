"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPropertyCredentials = exports.registerProperty = void 0;
const property_did_service_1 = require("../services/property-did.service");
const database_1 = require("../utils/database");
const registerProperty = async (req, res) => {
    try {
        const { address, city, state, postalCode, propertyType, metadata } = req.body;
        // Assuming auth middleware sets req.user
        const landlordId = req.user?.id;
        if (!landlordId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const result = await property_did_service_1.propertyDIDService.registerProperty(landlordId, {
            address, city, state, postalCode, propertyType, metadata
        });
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.registerProperty = registerProperty;
const getPropertyCredentials = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const property = await database_1.prisma.property.findUnique({ where: { id: propertyId } });
        if (!property) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }
        const credentials = await property_did_service_1.propertyDIDService.getPropertyCredentials(propertyId);
        res.status(200).json({ success: true, data: { property, credentials } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getPropertyCredentials = getPropertyCredentials;
//# sourceMappingURL=property.controller.js.map