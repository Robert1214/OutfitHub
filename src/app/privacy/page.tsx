export const metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs tracking-[0.28em] text-muted-foreground">LEGAL</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">隐私政策</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        本页面适用于演示项目 Wardrobe。演示环境不产生真实交易。
      </p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            1. 我们收集什么
          </h2>
          <p>
            账号信息（邮箱或手机号、昵称、密码哈希）、你主动填写的身材数据
            （身高、体重、胸围、腰围、臀围）、你上传的本人照片，以及购物车、
            订单和试穿记录。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            2. 用途
          </h2>
          <p>
            登录与账号识别；展示和保存购物车、订单；根据身材数据与成衣尺寸做
            合身判断；使用本人照片生成 AI 试穿图。照片不会用于训练模型。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            3. 存储与访问
          </h2>
          <p>
            账号与订单存于 Postgres；本人照片和试穿结果存于腾讯云 COS
            私有桶，通过短时签名 URL 访问。身材数据和照片仅本人可见，
            不会出现在公开商品页或导购回答中。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            4. 保留与删除
          </h2>
          <p>
            演示数据默认保留，直至你主动删除或管理员清理。你可以在个人中心
            删除本人照片；删除时会同步删除 COS 对象。试穿记录删除规则在 M4
            接入后生效。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            5. 第三方
          </h2>
          <p>
            演示环境使用腾讯云 COS/MPS 完成照片存储与 AI 试穿，使用 Dify
            提供导购回答（M5）。第三方只接收完成对应功能所需的数据；
            密钥仅保存在服务端。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            6. 演示声明
          </h2>
          <p>
            本项目仅用于作品集展示，不接真实支付、短信或物流。请勿上传
            他人照片、未成年人照片或任何敏感个人信息。
          </p>
        </section>
      </div>
    </article>
  );
}
