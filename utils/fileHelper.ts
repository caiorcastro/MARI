
// This file provides utility functions for handling file conversions.

// Declare the XLSX variable loaded from the script tag in index.html to make TypeScript aware of it.
declare var XLSX: any;

/**
 * Converts a File object to a base64 encoded string, without the data URL prefix.
 * @param {File} file - The file to convert.
 * @returns {Promise<string>} A promise that resolves with the base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Reads a File object and returns its content as a plain text string.
 * Useful for .txt or .csv files.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} A promise that resolves with the file's text content.
 */
export const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Reads an Excel file (.xlsx) and converts its content to a structured text string.
 * Each sheet is converted to CSV format and clearly demarcated.
 * This runs entirely on the client-side using the SheetJS library.
 * @param {File} file - The Excel file to convert.
 * @returns {Promise<string>} A promise that resolves with the structured text content of the Excel file.
 */
export const convertExcelToText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                if (!event.target?.result) {
                    return reject(new Error("Failed to read file."));
                }
                const data = event.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                let fullText = '';
                // Iterate over each sheet in the workbook.
                workbook.SheetNames.forEach((sheetName: string) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const csv = XLSX.utils.sheet_to_csv(worksheet);
                    // Append the content with clear start/end markers for the AI to understand.
                    fullText += `--- START OF SHEET: ${sheetName} ---\n${csv}\n--- END OF SHEET: ${sheetName} ---\n\n`;
                });
                resolve(fullText.trim());
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Triggers a browser download for a given text content.
 * @param {string} content - The text content to be downloaded.
 * @param {string} filename - The desired name for the downloaded file.
 */
export const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
