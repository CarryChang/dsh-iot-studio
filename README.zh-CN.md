# dsh-iot-studio

面向 [DeepSeek Harness](https://github.com/deepseek-ai) 的 IoT 工作室插件：让 agent 通过类型化工具发现、查看并控制你的智能家居设备。首发支持小米 / 米家；更多 IoT 品牌沿同一 Provider 接缝接入。

> **开源来源声明。** 本插件的小米云协议实现（登录、RC4/SHA1 请求签名、设备列表、
> MIoT spec 查询）由开源项目 [hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot)
> （作者 **al-one**，**Apache License 2.0**）的 Python 源码移植改写而来，本仓库采用
> 与之一致的 Apache-2.0 协议。逐文件的来源与改动清单见 [NOTICE](NOTICE) 与
> [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本插件是独立的衍生项目，
> 与小米公司、Home Assistant 项目无隶属或背书关系。

## 提供给 agent 的能力

| 工具 | 用途 |
|---|---|
| `iot_list_devices` | 账号下全部设备：did、名称、model urn、在线状态、家庭/房间 |
| `iot_get_spec` | 某设备的可读 MIoT spec：服务、属性（访问权限/格式/取值范围/枚举）、动作（入参/出参） |
| `iot_get_props` | 读取指定属性，或不传参数获取整机快照（≤ 60 个可读属性） |
| `iot_set_prop` | 写单个属性：开关、亮度、目标温度、模式…… |
| `iot_call_action` | 按 spec 声明的入参顺序调用一个动作 |

内置技能（`iot-studio`）教给 agent 安全闭环：
列表 → spec → 读 → 写/动作 → 回读确认；操作门锁、摄像头、插座、加热器、
扫地机前必须先向用户确认。

## 安装

```sh
dsh plugin --profile web add https://github.com/CarryChang/dsh-iot-studio
```

## 配置凭据

方式 A —— 环境变量（推荐，密码不落盘）：

```
XIAOMI_USERNAME=<手机号/邮箱/用户 id>
XIAOMI_PASSWORD=<密码>
```

方式 B —— profile `cordis.yml` 中的插件 config：

```yaml
- id: iot-studio
  name: dsh-iot-studio
  config:
    defaultBrand: xiaomi
    xiaomi:
      username: 'you@example.com'
      password: '...'          # 留空则读 XIAOMI_PASSWORD
      serverCountry: cn        # cn、de、ru 等
      stateDir: ''             # token 缓存目录，默认 ~/.dsh-iot-studio
      httpTimeoutSec: 15
```

首次使用时插件自动登录并把 serviceToken 缓存到 `stateDir`
（文件权限 0600，永不提交、永不在输出中打印）。之后即使不配密码，
也能凭有效缓存工作直到 token 过期。

## 试试这些指令

```
> 帮我看下家里现在有哪些米家设备在线？
> 把卧室台灯调到 40% 亮度
> 扫地机开始清扫客厅
```

## 架构（给品牌贡献者）

```
src/
  index.ts               插件入口：Config + 技能 + 5 个工具
  skill.ts               内置 IoT 控制方法论
  brands/
    types.ts             IotBrandProvider 接缝（品牌无关 DTO）
    registry.ts          品牌 key -> provider 工厂
    xiaomi/
      crypto.ts          RC4-skip-1024、nonce、HMAC-SHA1、SHA1 签名
      cloud.ts           登录 step1/2/3、api.io.mi.com 签名请求
      spec.ts            miot-spec.org 实例获取与摘要
      provider.ts        IotBrandProvider 实现
```

新增品牌 = `src/brands/<name>/` 一个目录 + 一行 `register()`；
工具签名、配置结构、技能契约全部不变。工具只面向 `IotBrandProvider` 接口。

## 限制（v0.1）

- 登录遇到验证码 / 短信 / 邮箱验证时不做交互：工具返回可操作的提示，
  请先在 account.xiaomi.com 或米家 App 完成一次验证再重试。
- 仅支持 MIoT spec 设备；model 不是 `urn:miot-spec-v2:...` 的老 miio 设备暂不支持。
- 仅云控制；暂无局域网本地 token 通道。
- 通过 `serverCountry` 支持国区与海外服务器站点。

## 开发

```sh
pnpm install     # 需要能访问 @deepseek-ai 系列的 npm registry
pnpm run build   # tsc -> lib/
pnpm run check   # 构建 + 零网络确定性冒烟测试
```

## 许可协议

Apache License 2.0（与上游 [hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot) 一致）。
第三方声明见 [NOTICE](NOTICE)、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
