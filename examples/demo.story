# 游戏开始
quest_stage = 1
quest_stage += 2
quest_stage -= 1
del quest_stage
南贤：[#style=opening]游戏开始
胡斐：[#style=question-cards]少侠来此所谓何事？
- 无事
  jump nothing
- 乞讨
  change_silver(100)
  胡斐：给你钱
if item_count('小刀') >= 1 and money > 10
  - 出示小刀
    胡斐：这把刀从哪里来的？
  - 收起小刀

battle 新手战
- win
  南贤：少侠好身手
- lose
- timeout
  南贤：太墨迹了

if item_count('小刀') >= 1 and money > 100
  南贤：不错
elif not (item_count('小刀') >= 1) or money > 10
  南贤：也行
else
  南贤：穷鬼

# nothing
南贤：后会有期
