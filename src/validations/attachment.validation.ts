import { z } from "zod";

// "export" is system-generated (FR-6 Excel export writes it itself) —
// a client can only ever upload the source RFQ file or a supporting spec doc.
export const uploadAttachmentKindSchema = z.enum(["rfq_source", "spec_doc"]);
