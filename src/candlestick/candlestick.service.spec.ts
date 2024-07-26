import { Test, TestingModule } from '@nestjs/testing';
import { CandlestickService } from './candlestick.service';
import { CandlestickModule } from './candlestick.module';

describe('CandlestickService', () => {
  let service: CandlestickService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CandlestickModule],
    }).compile();

    service = module.get<CandlestickService>(CandlestickService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
