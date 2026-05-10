# 开局答题
toast off
background 地图.竹林
item 小还丹 3
get_money 100
：在来到这个世界之前，请允许询问您几个问题
- 继续..
：你希望你在武侠小说中的出身是
- 商人的儿子
  upgrade 臂力 主角 -5
  item 黑玉断续膏
  item 九转熊蛇丸
  item 金丝道袍
  item 金头箍 
  animation 主角 zydx
- 大草原上长大的孩子
  upgrade 身法 主角 15
  upgrade 定力 主角 -2
  upgrade 拳掌 主角 15
  learn talent 主角 猎人
  animation 主角 caoyuan 
- 名门世家
  upgrade 福缘 主角 3
  upgrade 臂力 主角 -3
  upgrade 定力 主角 2
  upgrade 悟性 主角 20
  upgrade 剑法 主角 2
  upgrade 根骨 主角 2
  item 银手镯
  get_money 100
  animation 主角 huodu
- 市井流浪的汉子
  upgrade 福缘 主角 -5
  upgrade 臂力 主角 12
  upgrade 刀法 主角 15
  upgrade 奇门 主角 12
  item 草帽
  animation 主角 shijing 
  get_money -100
- 疯子
  upgrade 悟性 主角 35
  upgrade 定力 主角 10
  upgrade 根骨 主角 10
  learn talent 主角 神经病
  animation 主角 fengzi 
- 书香门第
  upgrade 悟性 主角 20
  upgrade 臂力 主角 1
  upgrade 身法 主角 -10
  upgrade 根骨 主角 -5
  animation 主角 xiake 
：以下你觉得最宝贵的是
- 无尽的财宝
  get_money 1000
- 永恒的爱情
  upgrade 福缘 主角 15
- 坚强的意志
  upgrade 定力 主角 15
- 自由
  upgrade 身法 主角 15
- 至高无上的权力
  learn talent 主角 自我主义
：以下你觉得最可恶的行为是
- 调戏妇女
  upgrade 定力 主角 9
- 欺软怕硬
  upgrade 根骨 主角 6
  upgrade 定力 主角 6
- 偷奸耍滑
  upgrade 悟性 主角 10
- 切JJ练神功
  upgrade 根骨 主角 10
- 有美女不泡
  learn talent 主角 好色
：你最喜欢的兵刃是
- 拳
  upgrade 拳掌 主角 10
- 剑
  upgrade 剑法 主角 10
- 刀
  upgrade 刀法 主角 10
- 暗器
  upgrade 奇门 主角 10
：以下女性角色你最喜欢的是
- 黄蓉
  upgrade 悟性 主角 5
- 小龙女
  upgrade 定力 主角 5
- 郭襄
  upgrade 福缘 主角 5
  upgrade 根骨 主角 5
- 梅超风
  upgrade 拳掌 主角 6
  upgrade 臂力 主角 6
- 周芷若
  upgrade 定力 主角 10
：以下男性角色你最喜欢的是
- 张无忌
  upgrade 悟性 主角 5
  upgrade 根骨 主角 10
- 郭靖
  upgrade 悟性 主角 -10
  upgrade 福缘 主角 15
  upgrade 臂力 主角 5
- 杨过
  upgrade 悟性 主角 5
  upgrade 定力 主角 5
- 令狐冲
  upgrade 悟性 主角 10
- 林平之
  upgrade 剑法 主角 10
  upgrade 定力 主角 10

：以下你觉得最牛的人是
- 乔峰
  upgrade 臂力 主角 10
  upgrade 拳掌 主角 9
- 韦小宝 
  upgrade 福缘 主角 20
- 金庸先生
  upgrade 悟性 主角 13
  upgrade 剑法 主角 5
  upgrade 刀法 主角 5
  upgrade 拳掌 主角 5
  upgrade 奇门 主角 5
- 东方不败
  upgrade 根骨 主角 20
- 汉家松鼠
  upgrade 根骨 主角 10
  learn internal 主角 基本内功 20
  item 松果 3
- 半瓶神仙醋
  item 天王保命丹 6
：选择你的游戏难度
- 简单
  set_game_mode normal
- [color=yellow]进阶[/color]
  set_game_mode hard
- [color=red]炼狱[/color]
  set_game_mode crazy
// - [color=magenta]无悔[/color]
：请输入你的名字
- 继续..
  input_name 主角 小虾米
：请选择人物头像
- 继续..
  select_head 主角
：欢迎来到金庸群侠传的世界
- 继续..
  roll_stats
toast on
jump 新手村_出生
