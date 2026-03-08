import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('cloudinary')
@Controller('cloudinary')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
    constructor(private cloudinaryService: CloudinaryService) { }

    @Get('sign')
    getSignedUrl(@Query('folder') folder: string = 'sphinx-hr') {
        return this.cloudinaryService.generateSignedUploadUrl(folder);
    }
}
