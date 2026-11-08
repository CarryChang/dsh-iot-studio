/**
 * Brand-provider seam for dsh-iot-studio. Every IoT brand adapter (xiaomi today; tuya, apple
 * home, and others later) implements IotBrandProvider, and the registered tools only see this
 * interface plus the neutral DTOs below, so a new brand never changes tool signatures.
 * @module dsh-iot-studio/brands/types
 */
/** Error carrying a user-actionable message; tool execute maps it into the result envelope. */
export class IotUserError extends Error {
}
