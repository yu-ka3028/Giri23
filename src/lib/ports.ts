/** Production boundary: verify LIFF ID tokens on the server, never trust profile.userId alone. */
export interface AuthPort { signInWithLineIdToken(idToken: string): Promise<{ memberId: string }>; signOut(): Promise<void>; }
export interface RecordRepository { list(memberId: string): Promise<unknown[]>; save(memberId: string, record: unknown): Promise<void>; remove(memberId: string, recordId: string): Promise<void>; }
// TODO: implement with LINE token verification + DB repository before production release.
