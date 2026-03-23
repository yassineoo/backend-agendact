import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(AuthGuard('jwt'))
export class UploadsController {
    constructor(private uploadsService: UploadsService) {}

    /**
     * Upload a base64-encoded image.
     * Body: { image: "data:image/png;base64,...", folder?: "avatars" }
     */
    @Post('base64')
    async uploadBase64(@Body() body: { image: string; folder?: string }) {
        const url = await this.uploadsService.saveBase64(body.image, body.folder);
        return { url };
    }

    /**
     * Upload a file via multipart/form-data.
     */
    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { folder?: string },
    ) {
        const url = await this.uploadsService.saveBuffer(
            file.buffer,
            file.originalname,
            body.folder,
        );
        return { url };
    }
}
