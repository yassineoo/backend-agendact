import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadsService {
    private readonly uploadDir = path.join(process.cwd(), 'uploads');

    constructor() {
        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Save a base64 image to disk and return the public URL path.
     */
    async saveBase64(base64Data: string, folder?: string): Promise<string> {
        // Strip data URI prefix if present (e.g. "data:image/png;base64,")
        const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
        let ext = 'png';
        let data = base64Data;

        if (matches) {
            ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            data = matches[2];
        }

        const filename = `${crypto.randomUUID()}.${ext}`;
        const targetDir = folder
            ? path.join(this.uploadDir, folder)
            : this.uploadDir;

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

        const urlPath = folder ? `/uploads/${folder}/${filename}` : `/uploads/${filename}`;
        return urlPath;
    }

    /**
     * Save a buffer (from multer) to disk and return the public URL path.
     */
    async saveBuffer(buffer: Buffer, originalName: string, folder?: string): Promise<string> {
        const ext = path.extname(originalName) || '.png';
        const filename = `${crypto.randomUUID()}${ext}`;
        const targetDir = folder
            ? path.join(this.uploadDir, folder)
            : this.uploadDir;

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, buffer);

        const urlPath = folder ? `/uploads/${folder}/${filename}` : `/uploads/${filename}`;
        return urlPath;
    }
}
