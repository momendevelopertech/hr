import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionBody = exception instanceof HttpException ? exception.getResponse() : null;
        const message = this.resolveMessage(exceptionBody, status);

        if (status >= 500) {
            this.logger.error(
                `Unhandled error on ${request.method} ${request.url}`,
                exception instanceof Error ? exception.stack : JSON.stringify(exception),
            );
        }

        response.status(status).json({
            statusCode: status,
            message,
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }

    private resolveMessage(exceptionBody: unknown, status: number): string | string[] {
        if (typeof exceptionBody === 'string') {
            return exceptionBody;
        }

        if (exceptionBody && typeof exceptionBody === 'object' && 'message' in exceptionBody) {
            return (exceptionBody as { message: string | string[] }).message;
        }

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
            return 'An unexpected error occurred. Please try again later.';
        }

        return 'Request failed';
    }
}
