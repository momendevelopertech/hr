import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import csurf = require('csurf');
import { HttpExceptionFilter } from './shared/http-exception.filter';
import { getAllowedOrigins, getCookieSettings, getFrontendOrigin } from './shared/cookie-settings';
import { assertSecurityEnv } from './shared/env-check';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const isProd = process.env.NODE_ENV === 'production';
    assertSecurityEnv(isProd);
    app.disable('x-powered-by');
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    // Security
    app.use(helmet());
    app.use(cookieParser(process.env.CSRF_SECRET || 'sphinx-csrf'));
    const frontendOrigin = getFrontendOrigin();
    const allowedOrigins = getAllowedOrigins();
    const { sameSite, secure, domain, path } = getCookieSettings();

    const csrfProtection = csurf({
        cookie: {
            key: 'csrf_secret',
            httpOnly: true,
            secure,
            sameSite,
            path,
            ...(domain ? { domain } : {}),
        },
    });

    app.use((req, res, next) => {
        const method = (req.method || '').toUpperCase();
        const path = req.path || '';
        const shouldSkipCsrf =
            method === 'POST' &&
            (path === '/api/auth/refresh' || path === '/api/auth/logout');

        if (shouldSkipCsrf) {
            return next();
        }

        return csrfProtection(req, res, next);
    });

    app.use((err, req, res, next) => {
        if (err && err.code === 'EBADCSRFTOKEN') {
            return res.status(403).json({ message: 'Invalid CSRF token' });
        }
        return next(err);
    });

    // CORS
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-CSRF-Token',
            'X-No-Cache',
            'X-Allow-Cache',
            'X-Skip-Activity',
        ],
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

    // API prefix
    app.setGlobalPrefix('api', {
        exclude: [{ path: '', method: RequestMethod.GET }],
    });

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
