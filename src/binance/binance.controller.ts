/* eslint-disable prettier/prettier */
import {  Controller, Get, Post } from '@nestjs/common';
import { BinanceService } from './binance.service';

@Controller('binance')
export class BinanceController {
  constructor(private readonly binanceService: BinanceService) {}

  @Post('place-order')
  async placeOrder() {
    try {
      //const orderResponse = await this.binanceService.placeMarketOrder('BTCUSDT', 'BUY', 0.02);
      //console.log('Order placed successfully:', orderResponse);
    } catch (error) {
      console.error('Error placing order:', error);
    }
  }

  @Post('place-full-balance-order')
  async placeFullBalanceOrder() {
    //return this.binanceService.placeFullBalanceOrder(symbol, side);
    try {
      //const orderResponse = await this.binanceService.placeFullBalanceOrder('BTCUSDT', 'BUY');
      //console.log('Order placed successfully:', orderResponse);
    } catch (error) {
      //console.error('Error placing order:', error);
    }
  }

  @Get('balances')
  async fetchBalances() {
    return this.binanceService.getUSDTBalances();
  }

  @Get('show-balances')
  async showBalances() {
    return this.binanceService.showbalances();
  }
}