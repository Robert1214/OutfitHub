export const metadata = { title: "用户协议" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs tracking-[0.28em] text-muted-foreground">LEGAL</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">用户协议</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        最后更新：2026-11-02 · 演示环境
      </p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            1. 演示性质
          </h2>
          <p>
            OUTFIT EXPERT 是作品集演示项目，不提供真实商品销售、支付、
            物流或退款服务。页面中的「支付」「发货」「退款」均为演示流程，
            不产生真实资金往来。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            2. 账号
          </h2>
          <p>
            请使用自己的邮箱或手机号注册。手机验证码固定为 123456，
            仅用于演示。你应妥善保管密码，不得冒用他人身份或上传他人照片。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            3. 使用规则
          </h2>
          <p>
            不得利用本演示上传违法、侵权、暴力、色情或未成年人相关内容；
            不得尝试攻击、爬取或破坏服务；不得将演示数据用于商业用途。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            4. AI 结果
          </h2>
          <p>
            AI 试穿图由第三方模型生成，仅用于参考，不承诺与真实上身效果
            完全一致；合身判断基于你填写的尺寸，仅供参考，请以实物为准。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            5. 内容与知识产权
          </h2>
          <p>
            商品图、品牌名和演示素材仅用于作品集展示；请确保你上传的图片
            拥有合法使用权。演示方可在不另行通知的情况下调整或清理数据。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            6. 协议变更
          </h2>
          <p>
            本协议可能随演示功能调整而更新，更新后在本页展示。继续使用即
            表示接受更新后的协议。
          </p>
        </section>
      </div>
    </article>
  );
}
