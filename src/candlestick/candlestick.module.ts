/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CandlestickService } from './candlestick.service';
import { CandlestickGateway } from './candlestick.gateway';
import { DatabaseModule } from 'src/provider/database.module';
import { BinanceService } from 'src/binance/binance.service';
import { BinanceModule } from 'src/binance/binance.module';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from 'src/provider/database.provider';

@Module({
    imports: [
        DatabaseModule,
        BinanceModule,
    ],
    providers: [CandlestickService,DatabaseService, CandlestickGateway, BinanceService, ],
    exports: [CandlestickService],
})
export class CandlestickModule {}
