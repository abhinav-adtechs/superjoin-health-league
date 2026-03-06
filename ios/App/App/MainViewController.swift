import Capacitor
import UIKit
import WebKit

final class MainViewController: CAPBridgeViewController {
    private let refreshControl = UIRefreshControl()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = bridge?.webView else { return }

        setupRefreshControl(for: webView)
        webView.allowsBackForwardNavigationGestures = true
    }

    private func setupRefreshControl(for webView: WKWebView) {
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        refreshControl.tintColor = .label
        webView.scrollView.refreshControl = refreshControl
    }

    @objc private func handleRefresh() {
        bridge?.webView?.reload()
        refreshControl.endRefreshing()
    }
}
