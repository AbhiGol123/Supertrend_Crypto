export default () => ({
    mongodbUri: process.env.MONGODB_URI || 'your-default-mongodb-uri',
    databaseName: process.env.DATABASENAME,
    // Add other configuration variables here
});