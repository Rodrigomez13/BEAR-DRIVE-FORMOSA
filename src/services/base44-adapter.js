// Provider boundary. Screens express BearDrive intentions, never SDK mutations.
export function createBase44Services(client) {
  const command = (name, body = {}) => client.functions.invoke(name, body);
  return {
    auth: {
      publicSettings: () => client.app.getPublicSettings(),
      currentUser: () => client.auth.me(),
      logout: (returnTo = undefined) => client.auth.logout(returnTo),
      login: (returnTo) => client.auth.redirectToLogin(returnTo),
    },
    rides: {
      list: (query, sort, limit) => client.entities.Ride.filter(query, sort, limit),
      get: (id) => client.entities.Ride.get(id),
      subscribe: (callback) => client.entities.Ride.subscribe(callback),
      quote: (body) => command('calculateQuote', body),
      request: (body) => command('createRide', body),
      acceptOffer: (body) => command('acceptRide', body),
      transition: (body) => command('transitionRideStatus', body),
      validatePin: (body) => command('validateRidePin', body),
      complete: (body) => command('completeRide', body),
      cancelPassenger: (body) => command('passengerCancelRide', body),
      cancelDriver: (body) => command('driverCancelRide', body),
      rate: (body) => command('rateRide', body),
      offers: (body) => command('getNearbyRideRequests', body),
      activateQueued: (body) => command('activateQueuedRide', body),
    },
    drivers: {
      approvedVehicles: (id) => client.entities.Vehicle.filter({ driver_id: id, status: 'approved' }),
      locations: (id) => client.entities.DriverLocation.filter({ driver_id: id }),
      subscribeLocation: (callback) => client.entities.DriverLocation.subscribe(callback),
      updateLocation: (body) => command('updateDriverLocation', body),
      goOnline: (body) => command('driverGoOnline', body),
      goOffline: () => command('driverGoOffline'),
    },
    payments: {
      charges: (id) => client.entities.DriverDailyCharge.filter({ driver_id: id }, '-business_day', 50),
      accountStatus: () => command('getAccountStatus'),
      driverAccount: () => command('getDriverPaymentAccount'),
      connect: () => command('connectDriverPayments'),
      payDailyCharge: (body) => command('createDailyChargePayment', body),
      rideCheckout: (body) => command('getRidePaymentUrl', body),
      createRidePayment: (body) => command('createRidePayment', body),
    },
  };
}
