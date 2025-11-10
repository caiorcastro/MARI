
/**
 * Represents a part of a Gemini API request that contains file data.
 * The data is base64 encoded.
 */
export interface InlineDataPart {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

/**
 * Represents a part of a Gemini API request that contains text data.
 */
export interface TextPart {
    text: string;
}

/**
 * A union type representing either file data or text data for a multi-part Gemini prompt.
 */
export type GeminiPart = InlineDataPart | TextPart;

/**
 * Represents a grounding chunk from a Gemini API response, typically containing
 * web or map sources used by the model.
 */
export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
    maps?: {
        uri: string;
        title: string;
    };
}

/**
 * Represents a single client.
 */
export interface Client {
    id: string;
    name: string;
}

/**
 * Represents a group of clients categorized by a specific type (e.g., region or business unit).
 * Used for organizing the client selection dropdown.
 */
export interface ClientGroup {
    type: string;
    clients: Client[];
}
