const { expect } = require('chai');
const sinon = require('sinon');
const Bluebird = require('bluebird');
const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../protos/route_guide.proto');
const DB_PATH = path.join(__dirname, '../route_guide/route_guide_db.json');

const packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
const routeguide = grpc.loadPackageDefinition(packageDefinition).routeguide;
const client = new routeguide.RouteGuide('localhost:50051',
  grpc.credentials.createInsecure());

const COORD_FACTOR = 1e7;

describe('grpc api tests', () => {
  it('get feature', async () => {
    const point1 = {
      latitude: 409146138,
      longitude: -746188906,
    };
    const point2 = {
      latitude: 0,
      longitude: 0,
    };

    const expectedFeature1 = {
      "name": "Berkshire Valley Management Area Trail, Jefferson, NJ, USA",
      "location": {
        "latitude": 409146138,
        "longitude": -746188906
      }
    };
    const feature1 = await Bluebird.fromCallback((cb) => client.getFeature(point1, cb));
    expect(feature1).to.eql(expectedFeature1);

    const expectedFeature2 = {
      "name": "",
      "location": {
        "latitude": 0,
        "longitude": 0
      }
    };
    const feature2 = await Bluebird.fromCallback((cb) => client.getFeature(point2, cb));
    expect(feature2).to.eql(expectedFeature2);
  });
});
