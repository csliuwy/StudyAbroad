const BEIAN = "https://beian.miit.gov.cn/";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-line">
          Copyright © 2026 登录科技 All rights reserved. 由登录科技提供技术支持，联系{" "}
          <a href="mailto:support@denglu.net.cn">support@denglu.net.cn</a>
        </p>
        <p className="site-footer-line site-footer-beian">
          <a href={BEIAN} target="_blank" rel="noopener noreferrer">
            京ICP备15013491号-1
          </a>
        </p>
      </div>
    </footer>
  );
}
