export const metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs tracking-[0.28em] text-muted-foreground">LEGAL</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">隐私政策</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        本页面适用于演示项目 OutfitHub。演示环境不产生真实交易。
      </p>

      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            1. 我们收集什么
          </h2>
          <p>
            账号信息（邮箱或手机号、昵称、密码哈希）、你主动填写的身材数据
            （身高、体重、胸围、腰围、臀围）、你上传的本人照片、衣橱单品与
            搭配记录，以及试穿记录。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            2. 用途
          </h2>
          <p>
            登录与账号识别；保存你的衣橱单品与搭配；使用本人照片生成 AI 试穿图。
            照片仅用于试穿，不会用于训练模型。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">
            3. 存储与访问
          </h2>
          <p>
            账号、单品、搭配与试穿记录存于 Postgres；单品图、本人照片和试穿结果
            存于腾讯云 COS 私有桶，通过短时签名 URL 访问。所有数据仅本人可见。
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
            演示环境使用腾讯云 COS 存储图片、MPS 完成 AI 去背景与试穿。
            第三方只接收完成对应功能所需的图片与参数；密钥仅保存在服务端。
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
