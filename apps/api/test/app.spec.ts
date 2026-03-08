import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('AppModule', () => {
    it('should compile the application module', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        expect(moduleRef).toBeDefined();
    });
});
