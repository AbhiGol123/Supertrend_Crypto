import { Module } from '@nestjs/common';
import { DatabaseService } from './database.provider';
import { ConfigModule } from '@nestjs/config';
import { BinanceService } from 'src/binance/binance.service';
import { CandlestickService } from 'src/candlestick/candlestick.service';
import { CandlestickModule } from 'src/candlestick/candlestick.module';

@Module({
  imports: [
    ConfigModule.forRoot()],
  providers: [DatabaseService,CandlestickService, BinanceService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
