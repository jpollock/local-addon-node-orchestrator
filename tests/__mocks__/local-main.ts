export const getServiceContainer = jest.fn();
export const addIpcAsyncListener = jest.fn();

export interface AddonMainContext {
  hooks: {
    addAction: jest.Mock;
    addFilter: jest.Mock;
  };
}

export const mockServices = {
  localLogger: {
    log: jest.fn()
  },
  siteDatabase: {
    getConnection: jest.fn()
  },
  siteProcessManager: {
    getSiteProcess: jest.fn()
  }
};

export const createMockContext = (): AddonMainContext => ({
  hooks: {
    addAction: jest.fn(),
    addFilter: jest.fn()
  }
});

export const resetAllMocks = () => {
  jest.clearAllMocks();
  getServiceContainer.mockReturnValue({
    cradle: mockServices
  });
};
