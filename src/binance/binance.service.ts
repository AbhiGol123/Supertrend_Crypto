/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private apiKey = process.env.BINANCE_API_KEY;
  private apiSecret = process.env.BINANCE_API_SECRET;
  private apiUrl = 'https://testnet.binancefuture.com/fapi/v1';
  private balance: string;
  last_balance = 0;

  private generateSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }


  // Check account information
  async getAccountInfo(): Promise<any> {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = this.generateSignature(queryString);
    const url = `https://testnet.binancefuture.com/fapi/v2/account?${queryString}&signature=${signature}`;

    const headers = {
      'X-MBX-APIKEY': this.apiKey,
    };

    this.logger.debug(`Request URL: ${url}`);
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`);

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching account info: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response headers: ${JSON.stringify(error.response.headers)}`);
      }
      throw new Error(`Error fetching account info: ${error.message}`);
    }
  }


  // Check account balance
  async getUSDTBalances(): Promise<any> {
    const accountInfo = await this.getAccountInfo();
    const usdtBalance = accountInfo.assets.find(asset => asset.asset === 'USDT');
    //return usdtBalance ? usdtBalance : { asset: 'USDT', walletBalance: '0', availableBalance: '0' }; // For all information
    this.balance = usdtBalance ? usdtBalance.walletBalance : '0';
    return this.balance;
  }


  // Get current price of ETHUSDT
  async getCurrentBTCPrice(): Promise<number> {
    const url = `${this.apiUrl}/ticker/price?symbol=BTCUSDT`;
    try {
      const response = await axios.get(url);
      return parseFloat(response.data.price);
    } catch (error) {
      this.logger.error(`Error fetching ETH price: ${error.message}`);
      throw new Error(`Error fetching ETH price: ${error.message}`);
    }
  }

  // Show balance and store in variable
  async showbalances(){
    this.balance = await this.getUSDTBalances();
    return this.balance;
  }


  // Place market order
  async placeMarketOrder(symbol: string, side: string, quantity: number) {
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity.toFixed(3)}&timestamp=${timestamp}`;
    const signature = this.generateSignature(queryString);
    const url = `${this.apiUrl}/order?${queryString}&signature=${signature}`;

    const headers = {
      'X-MBX-APIKEY': this.apiKey,
    };

    try {
      const response = await axios.post(url, null, { headers });
      if (response.data.status === 'FILLED') {
        //this.logger.debug(`Order filled successfully: ${JSON.stringify(response.data)}`);
        console.log("Order placing successfully")
      }
      return response.data;
    } catch (error) {
      //this.logger.error(`Error placing order: ${error.message}`);
      throw new Error(`Error placing order: ${error.message}`);
    }
  }


  // Place full balances order
  async placeFullBalanceOrder(symbol: string, side: string) {
    if(side === "BUY"){
        const usdtBalance = await this.getUSDTBalances();
        const btcPrice = await this.getCurrentBTCPrice();
        // Calculate the quantity of BTC to buy or sell
        const quantity = parseFloat(usdtBalance) / btcPrice;
        //console.log("quantity", quantity);

        // Round the quantity to a precision accepted by Binance (e.g., 6 decimal places for BTC)
        const roundedQuantity = (Math.floor(quantity * 1e6) / 1e6);
        //console.log("round",roundedQuantity);
        this.last_balance = roundedQuantity;
        return this.placeMarketOrder(symbol, side, roundedQuantity);
    }
    else{
      return this.placeMarketOrder(symbol, side, this.last_balance);

    }

    //return this.placeMarketOrder(symbol, side, roundedQuantity);
  }
}
