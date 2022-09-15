export interface Request {
  from: Waypoint;
  goals: Waypoint[];
  options: Options;
}


export enum Things {
  Event = 'myevent',
  Update = 'update',
}

export enum Washing {
  Laundry = 'laundry',
}

export type All =
| Things
  | Washing;
