import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as csurf from 'csurf';
import { HttpExceptionFilter } from './shared/http-exception.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const isProd = process.env.NODE_ENV === 'production';
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    // Security
    app.use(helmet());
    app.use(cookieParser(process.env.CSRF_SECRET || 'sphinx-csrf'));
    app.use(
        csurf({
            cookie: {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
            },
        }),
    );

    app.use((err, req, res, next) => {
        if (err && err.code === 'EBADCSRFTOKEN') {
            return res.status(403).json({ message: 'Invalid CSRF token' });
        }
        return next(err);
    });

    // CORS
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    });

    // Global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            stopAtFirstError: true,
        }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    // WebSocket adapter
    app.useWebSocketAdapter(new IoAdapter(app));

    // API prefix
    app.setGlobalPrefix('api');

    // Swagger docs
    if (!isProd) {
        const config = new DocumentBuilder()
            .setTitle('SPHINX HR System API')
            .setDescription('Enterprise HR Management System API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
    }

    const port = process.env.API_PORT || 3001;
    await app.listen(port);
    console.log(`🚀 SPHINX HR API running on http://localhost:${port}`);
    if (!isProd) {
        console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
    }
}

bootstrap();
