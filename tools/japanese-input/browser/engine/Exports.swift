import Foundation

@_cdecl("allocate") public func allocate(_ size: Int32) -> UnsafeMutablePointer<UInt8> {
    UnsafeMutablePointer<UInt8>.allocate(capacity: Int(size))
}
@_cdecl("release_buffer") public func releaseBuffer(_ pointer: UnsafeMutablePointer<UInt8>) { pointer.deallocate() }

@_cdecl("convert_json") @MainActor
public func convertJSON(_ pointer: UnsafePointer<UInt8>, _ length: Int32) -> UnsafeMutablePointer<CChar> {
    do {
        let request = try JSONDecoder().decode(ConversionInput.self, from: Data(bytes: pointer, count: Int(length)))
        let output = try conversionPayload(request)
        let buffer = UnsafeMutablePointer<CChar>.allocate(capacity: output.count + 1)
        for (index, byte) in output.enumerated() { buffer[index] = CChar(bitPattern: byte) }
        buffer[output.count] = 0
        return buffer
    } catch {
        return strdup("{\"error\":\"Invalid conversion request\"}")!
    }
}
