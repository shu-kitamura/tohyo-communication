export const CLOSED_ROOM_RETENTION_DAYS = 30;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export async function deleteExpiredRooms(
  database: D1Database,
  scheduledTime: number = Date.now(),
): Promise<number> {
  const cutoff = new Date(
    scheduledTime - CLOSED_ROOM_RETENTION_DAYS * DAY_IN_MILLISECONDS,
  ).toISOString();
  const [countResult] = await database.batch([
    database
      .prepare(
        `SELECT COUNT(*) AS roomCount
         FROM rooms
         WHERE status = 'closed'
           AND closed_at <= ?`,
      )
      .bind(cutoff),
    database
      .prepare(
        `DELETE FROM rooms
         WHERE status = 'closed'
           AND closed_at <= ?`,
      )
      .bind(cutoff),
  ]);
  const deletedRoomCount =
    (countResult.results[0] as { roomCount: number } | undefined)?.roomCount ?? 0;

  console.log("Expired room cleanup completed", {
    cutoff,
    deletedRoomCount,
  });

  return deletedRoomCount;
}
