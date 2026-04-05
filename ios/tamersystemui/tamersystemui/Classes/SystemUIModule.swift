import UIKit
import Lynx

private final class ThemeObserverView: UIView {
    var onTraitChange: (() -> Void)?

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        onTraitChange?()
    }
}

@objcMembers
public final class SystemUIModule: NSObject, LynxModule {
    public static var name: String { "SystemUIModule" }

    public static var methodLookup: [String: String] {
        [
            "setStatusBar": NSStringFromSelector(#selector(setStatusBar(_:))),
            "setNavigationBar": NSStringFromSelector(#selector(setNavigationBar(_:style:))),
            "setRootBackground": NSStringFromSelector(#selector(setRootBackground(_:))),
            "getThemeColors": NSStringFromSelector(#selector(getThemeColors(_:))),
        ]
    }

    public static weak var shared: SystemUIModule?

    private weak var lynxContext: LynxContext?
    private weak var observerView: ThemeObserverView?
    private var cachedTheme: [String: Any]?
    private var statusBarStyle: UIStatusBarStyle = .default

    @objc public var statusBarStyleRawForHost: Int {
        statusBarStyle.rawValue
    }

    public static var statusBarStyleForHost: UIStatusBarStyle {
        shared?.statusBarStyle ?? .default
    }

    public required init(param: Any) {
        super.init()
        lynxContext = param as? LynxContext
        SystemUIModule.shared = self
        DispatchQueue.main.async { [weak self] in
            self?.attachObserverView()
            self?.refreshThemeAndNotify(force: true)
        }
    }

    public override init() {
        super.init()
        SystemUIModule.shared = self
        DispatchQueue.main.async { [weak self] in
            self?.attachObserverView()
            self?.refreshThemeAndNotify(force: true)
        }
    }

    @objc func setStatusBar(_ style: String) {
        DispatchQueue.main.async {
            self.statusBarStyle = style == "dark" ? .darkContent : .lightContent
            self.applyStatusBarStyle()
        }
    }

    @objc func setNavigationBar(_ color: String, style: String) {
        DispatchQueue.main.async {
            self.applyRootBackground(color)
            self.setStatusBar(style)
        }
    }

    @objc func setRootBackground(_ color: String) {
        DispatchQueue.main.async {
            self.applyRootBackground(color)
        }
    }

    @objc func getThemeColors(_ callback: @escaping (Any) -> Void) {
        DispatchQueue.main.async {
            callback(self.buildThemeColors())
        }
    }

    private func keyWindow() -> UIWindow? {
        if #available(iOS 13.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }
        }
        return UIApplication.shared.keyWindow
    }

    private func attachObserverView() {
        guard let window = keyWindow() else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                self?.attachObserverView()
            }
            return
        }
        if observerView?.superview === window {
            return
        }

        let observer = ThemeObserverView(frame: window.bounds)
        observer.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        observer.isUserInteractionEnabled = false
        observer.backgroundColor = .clear
        observer.onTraitChange = { [weak self] in
            self?.refreshThemeAndNotify(force: false)
        }
        window.addSubview(observer)
        observerView = observer
    }

    private func applyStatusBarStyle() {
        if let window = keyWindow() {
            window.rootViewController?.setNeedsStatusBarAppearanceUpdate()
        }

        if UIApplication.shared.responds(to: Selector(("setStatusBarStyle:"))) {
            UIApplication.shared.setValue(statusBarStyle.rawValue, forKey: "statusBarStyle")
        }
    }

    private func applyRootBackground(_ colorString: String) {
        guard let color = parseColor(colorString) else { return }
        let window = keyWindow()
        window?.backgroundColor = color
        window?.rootViewController?.view.backgroundColor = color
    }

    private func refreshThemeAndNotify(force: Bool) {
        let next = buildThemeColors()
        if !force, NSDictionary(dictionary: next).isEqual(to: cachedTheme ?? [:]) {
            return
        }
        cachedTheme = next
        sendThemeChanged(next)
    }

    private func buildThemeColors() -> [String: Any] {
        let trait = observerView?.traitCollection ?? keyWindow()?.traitCollection ?? UIScreen.main.traitCollection
        let isDark = trait.userInterfaceStyle == .dark
        let background = UIColor.systemBackground.resolvedColor(with: trait)
        let surface = UIColor.secondarySystemBackground.resolvedColor(with: trait)
        let surfaceContainer = UIColor.tertiarySystemBackground.resolvedColor(with: trait)
        let onSurface = UIColor.label.resolvedColor(with: trait)
        let primary = (keyWindow()?.tintColor ?? UIColor.systemBlue).resolvedColor(with: trait)
        let primaryDark = UIColor.systemIndigo.resolvedColor(with: trait)
        let onSurfaceVariant = UIColor.secondaryLabel.resolvedColor(with: trait)
        let secondaryContainer = blend(primary, surface, 0.18, trait: trait)
        let onSecondaryContainer = primary
        let surfaceContainerLow = blend(background, surface, 0.35, trait: trait)
        let surfaceContainerHigh = blend(surface, surfaceContainer, 0.5, trait: trait)
        let surfaceContainerHighest = blend(surface, surfaceContainer, 0.72, trait: trait)
        return [
            "primary": hex(primary),
            "primaryDark": hex(primaryDark),
            "onPrimaryContainer": isDark ? "#eaddff" : "#21005d",
            "background": hex(background),
            "surface": hex(surface),
            "surfaceContainer": hex(surfaceContainer),
            "surfaceContainerLow": hex(surfaceContainerLow),
            "surfaceContainerHigh": hex(surfaceContainerHigh),
            "surfaceContainerHighest": hex(surfaceContainerHighest),
            "onSurface": hex(onSurface),
            "onSurfaceVariant": hex(onSurfaceVariant),
            "secondaryContainer": hex(secondaryContainer),
            "onSecondaryContainer": hex(onSecondaryContainer),
            "isDark": isDark,
        ]
    }

    private func blend(_ a: UIColor, _ b: UIColor, _ t: CGFloat, trait: UITraitCollection) -> UIColor {
        let a1 = a.resolvedColor(with: trait)
        let b1 = b.resolvedColor(with: trait)
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        var okA = a1.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        if !okA {
            var w: CGFloat = 0
            a1.getWhite(&w, alpha: &aa)
            ar = w
            ag = w
            ab = w
        }
        var okB = b1.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        if !okB {
            var w: CGFloat = 0
            b1.getWhite(&w, alpha: &ba)
            br = w
            bg = w
            bb = w
        }
        return UIColor(
            red: ar * (1 - t) + br * t,
            green: ag * (1 - t) + bg * t,
            blue: ab * (1 - t) + bb * t,
            alpha: 1
        )
    }

    private func sendThemeChanged(_ theme: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: theme),
              let payload = String(data: data, encoding: .utf8) else { return }
        let params: [[String: Any]] = [["payload": payload]]
        DispatchQueue.main.async { [weak self] in
            guard let ctx = self?.lynxContext ?? SystemUIModule.shared?.lynxContext else { return }
            ctx.sendGlobalEvent("system-ui:themeChanged", withParams: params)
        }
    }

    private func hex(_ color: UIColor) -> String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        color.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return String(format: "#%02x%02x%02x",
                      Int(round(red * 255)),
                      Int(round(green * 255)),
                      Int(round(blue * 255)))
    }

    private func parseColor(_ value: String) -> UIColor? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return nil }

        if trimmed.hasPrefix("#") {
            let hex = String(trimmed.dropFirst())
            let normalized: String
            if hex.count == 3 {
                normalized = hex.map { "\($0)\($0)" }.joined()
            } else {
                normalized = hex
            }
            guard normalized.count == 6, let raw = Int(normalized, radix: 16) else { return nil }
            return UIColor(
                red: CGFloat((raw >> 16) & 0xFF) / 255,
                green: CGFloat((raw >> 8) & 0xFF) / 255,
                blue: CGFloat(raw & 0xFF) / 255,
                alpha: 1
            )
        }

        if trimmed.hasPrefix("rgb(") || trimmed.hasPrefix("rgba(") {
            let body = trimmed
                .replacingOccurrences(of: "rgba(", with: "")
                .replacingOccurrences(of: "rgb(", with: "")
                .replacingOccurrences(of: ")", with: "")
            let parts = body.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count >= 3,
                  let r = Double(parts[0]),
                  let g = Double(parts[1]),
                  let b = Double(parts[2]) else { return nil }
            let a = parts.count >= 4 ? Double(parts[3]) ?? 1 : 1
            return UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a)
        }

        return nil
    }
}
