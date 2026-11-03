export interface DuofietsStatus {
  isAvailable: boolean; // true = fiets is aanwezig; false = fiets is geleend / weg
  expectedReturnTime?: string; // HH:mm tot wanneer de fiets weg is
  borrowedAt?: string; // HH:mm wanneer de fiets meegenomen is
  updatedAt: string;
}
