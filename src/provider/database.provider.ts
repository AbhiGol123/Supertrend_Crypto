import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, connect, disconnect, connection,} from 'mongoose';
import { BinanceService } from 'src/binance/binance.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection: Connection;
  signal_count = 0;

  constructor(
    private configService: ConfigService,
    private binanceService: BinanceService,
  ) {}

  async onModuleInit() {
    try {
      const uri = this.configService.get<string>('mongodbUri');
      const dbName = this.configService.get<string>('databaseName');
      if (!uri) {
        throw new Error('MONGODB_URI is not defined in the environment variables');
      }
      await connect(uri, {dbName});
      this.connection = connection.useDb(dbName); // Specify the database name
      console.log(`Connected ${dbName} database.`);
    } catch (error) {
      console.error('Error connecting to MongoDB:', error.message);
      throw new Error('Failed to initialize MongoDB connection');
    }
  }

  async onModuleDestroy() {
    await this.closeConnection();
  }

  async closeConnection(): Promise<void> {
    if (this.connection) {
      await disconnect();
      console.log('Disconnected from MongoDB');
    }
  }

  async insertOne(collectionName: string, document: any): Promise<void> {
    try {
      await this.connection.collection(collectionName).insertOne(document);
      console.log(`${collectionName} inserted successfully`);
    } catch (error) {
      console.error('Error inserting document:', error.message);
      throw new Error('Failed to insert document');
    }
  }


  async insertSignalOne(collectionName: string, document: any[]): Promise<void> {
    try {
      const collection = this.connection.collection(collectionName);
      for (const signal of document) {
        const existingSignal = await collection.findOne({ open_time: signal.open_time, symbol: signal.symbol, price: signal.price});
        if (!existingSignal) {
          await collection.insertOne(signal);
          //console.log(`${collectionName}Signal Document inserted successfully:`, signal);
          const signal_type = (signal.signal).toUpperCase();
          try {
            if (signal_type !== "SELL" || this.signal_count >= 1) {
              // Uncomment and use the following lines if binanceService is available
              //const orderResponse = await this.binanceService.placeFullBalanceOrder("BTCUSDT", signal_type);
              //console.log('Order placed successfully:', orderResponse);
              this.signal_count++;
            }
          } catch (error) {
            console.error('Error placing order:', error);
          }
        } else {
          //console.log('Duplicate signal found. Skipping:', signal);
        }
      }
      //console.log('Signals data processed successfully');
    } catch (error) {
      console.error('Error inserting document:', error.message);
      throw new Error('Failed to insert document');
    }
  }


  async saveCandlestickData(collectionName: string, data: any): Promise<void> {
    try {
      // Specify the collection name and document to insert
      await this.insertOne(collectionName, data);
    } catch (error) {
      console.error('Error saving data:', error.message);
      throw new Error('Failed to save data');
    }
  }


  async saveSignalData(collectionName: string, data: any): Promise<void> {
    try {
      // Specify the collection name and document to insert
      await this.insertSignalOne(collectionName, data);
    } catch (error) {
      console.error('Error saving signal data:', error.message);
      throw new Error('Failed to save signal data');
    }
  }
}
