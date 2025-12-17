import {MongoClient} from 'mongodb';
import {mongoConfig} from './settings.js';

let _connection = undefined;
let _db = undefined;

const dbConnection = async () => {
  if (!_connection) {
    _connection = await MongoClient.connect(mongoConfig.connectionString);
    
    
    _db = _connection.db(); 
  }

  return _db;
};

const closeConnection = async () => {
  if (_connection) {
      await _connection.close();
      _connection = undefined; 
      _db = undefined;
  }
};

export {dbConnection, closeConnection};
