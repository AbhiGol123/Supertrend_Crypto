import { Injectable, OnModuleInit } from '@nestjs/common';
import * as WebSocket from 'ws';
import { DatabaseService } from '../provider/database.provider';
import { BinanceService } from '../binance/binance.service';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CandlestickGateway } from './candlestick.gateway'

@Injectable()
export class CandlestickService implements OnModuleInit {

    private wsMap: Map<string, WebSocket> = new Map();
    private candlestickMap: Map<string, any[]> = new Map();
    private recordedDataMap: Map<string, any[]> = new Map();
    private lastMinuteMap: Map<string, number> = new Map();
    private lastRecordedMinuteMap: Map<string, number> = new Map();
    private lastSignalMap: Map<string, any> = new Map();
    private lastCountMap: Map<string, number> = new Map();
    private totalBalanceMap: Map<string, number> = new Map();
    private totalProfitLossMap: Map<string, number> = new Map();
    private coinMap: Map<string, number> = new Map();
    private time_interval: any = Number(process.env.TIME);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly candlestickGateway: CandlestickGateway,
        private readonly binanceService: BinanceService,
        private readonly configService: ConfigService,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    async onModuleInit() {
        await this.startFetchingData();
        this.startListeningForDbChanges();
    }

    private startListeningForDbChanges() {
        const collection = this.connection.useDb("Multiple_Symbols_Trading").collection('Watch_Symbols');
        const changeStream = collection.watch();

        changeStream.on('change', async (change: any) => {
            if (change.operationType === 'update' && change.updateDescription) {
                const updatedFields = change.updateDescription.updatedFields;
                if (updatedFields.symbol) {
                    const symbol = updatedFields.symbol;
                    // Check if the WebSocket for the symbol is connected or not
                    if (!this.wsMap.has(symbol)) {
                        await this.connectWebSocket(symbol);
                    }
                }
            }
        });
    }

    async startFetchingData() {
        const symbols = await this.getSymbolsFromDatabase();
        symbols.forEach(symbol => {
            if (!this.wsMap.has(symbol)) {
                this.connectWebSocket(symbol);
            }
        });
    }

    private async getSymbolsFromDatabase(): Promise<string[]> {
        const collection = this.connection.useDb("Multiple_Symbols_Trading").collection('Watch_Symbols');
        const symbols = await collection.find().toArray();
        return symbols.map(symbol => symbol.symbol);
    }

    private async connectWebSocket(symbol: string) {
        const interval = process.env.INTERVAL;
        const wsUrl = `wss://fstream.binance.com/ws/${symbol}@kline_${interval}`;
        const ws = new WebSocket(wsUrl);

        this.wsMap.set(symbol, ws);
        this.candlestickMap.set(symbol, []);
        this.recordedDataMap.set(symbol, []);
        this.lastMinuteMap.set(symbol, 0);
        this.lastRecordedMinuteMap.set(symbol, -1);
        this.lastSignalMap.set(symbol, null);
        this.lastCountMap.set(symbol, 0);
        this.totalBalanceMap.set(symbol, 100000);
        this.totalProfitLossMap.set(symbol, 0);
        this.coinMap.set(symbol, 0);

        ws.on('open', () => {
            console.log(`WebSocket connected for ${symbol}`);
        });

        ws.on('message', async (data: string) => {
            const candlestickData = JSON.parse(data);
            if (candlestickData && candlestickData.k) {
                const processedData = {
                    s: String(candlestickData.s),
                    t: new Date(candlestickData.k.t),
                    o: parseFloat(candlestickData.k.o),
                    h: parseFloat(candlestickData.k.h),
                    l: parseFloat(candlestickData.k.l),
                    c: parseFloat(candlestickData.k.c)
                };

                this.candlestickMap.get(symbol).push(processedData);

                const currentMinute = processedData.t.getMinutes();
                if (this.lastMinuteMap.get(symbol) !== currentMinute && currentMinute !== 0) {
                    this.lastMinuteMap.set(symbol, currentMinute);
                    await this.saveToDatabase(symbol);
                    await this.calculateSupertrendForMultipleSymbols();
                }
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket disconnected for ${symbol}`);
            // Attempt to reconnect if necessary
            setTimeout(() => {
                this.connectWebSocket(symbol);
            }, 1000);
        });

        ws.on('error', (error: Error) => {
            console.error(`WebSocket error for ${symbol}:`, error.message);
        });
    }

    async saveToDatabase(symbol: string) {
        const candlesticks = this.candlestickMap.get(symbol);
        if (candlesticks.length === 0) {
            return;
        }

        const currentMinute = new Date().getMinutes();
        const lastRecordedMinute = this.lastRecordedMinuteMap.get(symbol);
        if (currentMinute % this.time_interval !== 0 || currentMinute === lastRecordedMinute) {
            return;
        }

        this.lastRecordedMinuteMap.set(symbol, currentMinute);

        const lastThreeMinuteData = candlesticks.filter(data => {
            const minutes = data.t.getMinutes();
            return minutes >= (currentMinute - this.time_interval) && minutes < currentMinute;
        });

        const lastCandlestick = lastThreeMinuteData[lastThreeMinuteData.length - 1];
        if (!lastCandlestick) {
            return;
        }

        try {
            const recordedData = this.recordedDataMap.get(symbol);
            recordedData.push({
                s: lastCandlestick.s,
                t: new Date(lastCandlestick.t),
                o: lastCandlestick.o,
                h: lastCandlestick.h,
                l: lastCandlestick.l,
                c: lastCandlestick.c
            });

        } catch (error) {
            console.error('Error writing to Database:', error);
        }
    }

    async calculateSupertrendForMultipleSymbols(period = 10, multiplier = 3) {
        const symbols = Array.from(this.candlestickMap.keys());
        const results = [];

        symbols.forEach(symbol => {
            const data = this.recordedDataMap.get(symbol);

            const tr = data.map((d, i) => {
                if (i === 0) return 0;
                const highLow = d.h - d.l;
                const highClose = Math.abs(d.h - data[i - 1].c);
                const lowClose = Math.abs(d.l - data[i - 1].c);
                return Math.max(highLow, highClose, lowClose);
            });

            const atr = tr.map((_, i) => {
                if (i < period - 1) return 0;
                const sum = tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                return sum / period;
            });

            const upperband = [];
            const lowerband = [];
            const inUptrend = new Array(data.length).fill(true);

            for (let i = 0; i < data.length; i++) {
                const middleBand = (data[i].h + data[i].l) / 2;
                upperband.push(middleBand + multiplier * atr[i]);
                lowerband.push(middleBand - multiplier * atr[i]);

                if (i === 0) continue;

                if (data[i].c > upperband[i - 1]) {
                    inUptrend[i] = true;
                } else if (data[i].c < lowerband[i - 1]) {
                    inUptrend[i] = false;
                } else {
                    inUptrend[i] = inUptrend[i - 1];
                    if (inUptrend[i]) {
                        lowerband[i] = Math.max(lowerband[i], lowerband[i - 1]);
                    } else {
                        upperband[i] = Math.min(upperband[i], upperband[i - 1]);
                    }
                }
            }

            const supertrend = inUptrend.map((trend, i) => (trend ? lowerband[i] : upperband[i]));
            results.push({ symbol, supertrend, inUptrend });

            this.generateSignals(symbol, data, inUptrend);
        });

        return results;
    }

    async generateSignals(symbol: string, data: any[], inUptrend: boolean[]) {
        const signals = [];
        for (let i = 1; i < inUptrend.length; i++) {
            if (inUptrend[i] && !inUptrend[i - 1]) {
                const newSignal = { signal: 'Buy', symbol: data[i].s, open_time: new Date(data[i].t), signal_time: Date.now(), price: data[i].l };
                if (!this.lastSignalMap.get(symbol) || this.lastSignalMap.get(symbol).type !== newSignal.signal || this.lastSignalMap.get(symbol).date !== newSignal.open_time) {
                    this.lastSignalMap.set(symbol, newSignal);
                    signals.push(newSignal);
                }
            } else if (!inUptrend[i] && inUptrend[i - 1]) {
                const newSignal = { signal: 'Sell', symbol: data[i].s, open_time: new Date(data[i].t), signal_time: Date.now(), price: data[i].h };
                if (!this.lastSignalMap.get(symbol) || this.lastSignalMap.get(symbol).type !== newSignal.signal || this.lastSignalMap.get(symbol).date !== newSignal.open_time) {
                    this.lastSignalMap.set(symbol, newSignal);
                    signals.push(newSignal);
                }
            }
        }

        if (signals.length > 0) {

            const lastCount = this.lastCountMap.get(symbol);

            if (signals.length >= 2 && lastCount + 2 === signals.length) {
                const first = signals[signals.length - 2];
                const second = signals[signals.length - 1];
                const totalBalance = this.totalBalanceMap.get(symbol);
                const totalProfitLoss = this.totalProfitLossMap.get(symbol);
                const totalCoin = this.coinMap.get(symbol);

                // For Buy Signal
                if (first.signal === "Sell") {

                    this.totalBalanceMap.set(symbol, 0);  // For remaining balance
                    second.remaining_balance = 0;

                    second.total_profit_loss = parseFloat((totalProfitLoss).toFixed(5));   // For total or loss

                    this.coinMap.set(symbol, parseFloat((totalBalance / second.price).toFixed(5)));
                    second.coin = parseFloat((totalBalance / second .price).toFixed(5));   // For coins

                }

                // For Sell Signal
                if (first.signal === "Buy") {

                    const profit = parseFloat(((parseFloat((second.price * totalCoin).toFixed(5)) - parseFloat((first.price * totalCoin).toFixed(5))).toFixed(5))); // For this signal profit or loss
                    second.profit_or_loss = profit;

                    this.totalBalanceMap.set(symbol, parseFloat(((second.price * totalCoin)).toFixed(5))); // For remaining balance
                    second.remaining_balance = parseFloat((second.price * totalCoin).toFixed(5));

                    this.totalProfitLossMap.set(symbol, parseFloat((totalProfitLoss + profit).toFixed(5))); // For total profit or loss
                    second.total_profit_loss = parseFloat((totalProfitLoss + profit).toFixed(5));

                    second.coin = 0;  // for coin

                }
                await this.databaseService.saveSignalData(`${symbol.toUpperCase()}_Signal_Data`, signals);
                this.lastCountMap.set(symbol, lastCount + 1);

            } else if (signals.length === 1 && signals[0].signal === "Sell") {
                // Handle single Sell signal if needed

            } else if (signals.length === 1 && signals[0].signal === "Buy") {
                const first = signals[signals.length - 1];
                const totalBalance = this.totalBalanceMap.get(symbol);

                this.totalBalanceMap.set(symbol, 0);  // For remaining balance
                first.remaining_balance = 0;

                first.total_profit_loss = 0;   // For total or loss

                this.coinMap.set(symbol, parseFloat((totalBalance / first.price).toFixed(5)));
                first.coin = parseFloat((totalBalance / first .price).toFixed(5));   // For coins

                await this.databaseService.saveSignalData(`${symbol.toUpperCase()}_Signal_Data`, signals);
            }
        }

        this.candlestickGateway.server.emit('signals', signals);
    }
}

