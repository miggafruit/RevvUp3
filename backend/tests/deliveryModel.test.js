const Delivery = require('../src/models/Delivery');

test('the delivery code never appears in JSON (sockets/API responses)', () => {
  const d = new Delivery({
    order: '64b000000000000000000001',
    client: '64b000000000000000000002',
    shop: '64b000000000000000000003',
    pickupAddress: 'a',
    dropoffAddress: 'b',
    dropoffPhone: '1',
    totalAmount: 1,
    deliveryCode: '1234'
  });
  expect(d.toJSON().deliveryCode).toBeUndefined();
  expect(JSON.parse(JSON.stringify(d)).deliveryCode).toBeUndefined();
  expect(d.codeAttempts).toBe(0);
});

test('new statuses are valid', () => {
  const d = new Delivery({ status: 'return_to_shop' });
  expect(d.validateSync()?.errors?.status).toBeUndefined();
});
