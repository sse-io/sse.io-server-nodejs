export type sseContext = {
  params: any;
  query: any;
};

export type IRegisterOptions = {
  getRoomId: (context: sseContext) => string;
  fetch?: (context: sseContext) => Promise<any>;
};
