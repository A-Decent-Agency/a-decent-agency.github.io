import AppKit
import PDFKit

guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: swift scripts/map-preview.swift source.pdf output.jpg")
}
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
guard let document = PDFDocument(url: input), let page = document.page(at: 0) else {
    fatalError("Could not read the PDF's first page")
}
let image = page.thumbnail(of: NSSize(width: 1600, height: 1600), for: .mediaBox)
guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff),
      bitmap.pixelsWide <= 3200, bitmap.pixelsHigh <= 3200,
      let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) else {
    fatalError("Could not generate a bounded JPEG preview")
}
try data.write(to: output)
print("Wrote first-page preview: \(bitmap.pixelsWide) x \(bitmap.pixelsHigh), \(data.count) bytes. Source unchanged.")
