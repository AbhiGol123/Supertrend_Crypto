/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CandlestickService } from './candlestick/candlestick.service';
import { CandlestickGateway } from './candlestick/candlestick.gateway';
import { DatabaseService } from './provider/database.provider';
import { BinanceModule } from './binance/binance.module';
import configuration from './config/configuration';


@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal:true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:configService.get<string>('mongodbUri'),
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Change the path if your public folder is located elsewhere
    }),
    ConfigModule,
    BinanceModule,
  ],
  controllers: [AppController],
  providers: [AppService,DatabaseService,CandlestickGateway, CandlestickService,]
})
export class AppModule {}
