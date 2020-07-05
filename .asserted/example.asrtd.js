const { expect } = require('chai');
const Bluebird = require('bluebird');
const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../protos/route_guide.proto');
const DATA = require('../route_guide/route_guide_db.json');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const { routeguide } = grpc.loadPackageDefinition(packageDefinition);
const client = new routeguide.RouteGuide('localhost:50051', grpc.credentials.createInsecure());

const sortByName = ({ name: name1 }, { name: name2 }) => name1.localeCompare(name2);

describe('grpc api tests', () => {
  it('get feature - simple rpc', async () => {
    const point1 = {
      latitude: 409146138,
      longitude: -746188906,
    };
    const point2 = {
      latitude: 0,
      longitude: 0,
    };

    const expectedFeature1 = {
      name: 'Berkshire Valley Management Area Trail, Jefferson, NJ, USA',
      location: {
        latitude: 409146138,
        longitude: -746188906,
      },
    };
    const feature1 = await Bluebird.fromCallback((cb) => client.getFeature(point1, cb));
    expect(feature1).to.eql(expectedFeature1);

    const expectedFeature2 = {
      name: '',
      location: {
        latitude: 0,
        longitude: 0,
      },
    };
    const feature2 = await Bluebird.fromCallback((cb) => client.getFeature(point2, cb));
    expect(feature2).to.eql(expectedFeature2);
  });

  it('list features - server-side streaming rpc', async () => {
    const rectangle = {
      lo: {
        latitude: 400000000,
        longitude: -750000000,
      },
      hi: {
        latitude: 420000000,
        longitude: -730000000,
      },
    };

    const call = client.listFeatures(rectangle);

    const features = [];

    call.on('data', (feature) => features.push(feature));
    await Bluebird.fromCallback((cb) => call.on('end', cb));

    expect(features.length).to.eql(64);
    expect(features.sort(sortByName)).to.eql(DATA.sort(sortByName).filter(({ name }) => name.length > 0));
  });

  it('record route - client-side streaming rpc', async () => {
    const num_points = 10;

    let call;
    const recorded = Bluebird.fromCallback((callback) => (call = client.recordRoute(callback)));

    for (let i = 0; i < num_points; i++) {
      const {
        location: { latitude, longitude },
      } = DATA[30 + i];

      call.write({ latitude, longitude });
      // eslint-disable-next-line no-await-in-loop
      await Bluebird.delay(100);
    }

    await call.end();
    const stats = await recorded;

    expect(stats).to.eql({
      point_count: 10,
      feature_count: 4,
      distance: 455927,
      elapsed_time: 1,
    });
  });

  it('route chat - bidirectional streaming RPC', async () => {
    const call = client.routeChat();

    const gotNotes = [];
    call.on('data', (note) => gotNotes.push(note));

    const result = Bluebird.fromCallback((callback) => call.on('end', callback));

    const notes = [
      {
        location: {
          latitude: 0,
          longitude: 0,
        },
        message: 'First message',
      },
      {
        location: {
          latitude: 0,
          longitude: 1,
        },
        message: 'Second message',
      },
      {
        location: {
          latitude: 1,
          longitude: 0,
        },
        message: 'Third message',
      },
      {
        location: {
          latitude: 0,
          longitude: 0,
        },
        message: 'Fourth message',
      },
    ];

    notes.forEach((note) => call.write(note));
    call.end();

    await result;

    const expectedNotes = [
      {
        location: {
          latitude: 0,
          longitude: 0,
        },
        message: 'First message',
      },
    ];

    expect(gotNotes).to.eql(expectedNotes);
  });
});
