"""
从 MongoDB license 库 productInfo 表查询 status=01 的数据，
导出 productId 和 productName 字段到 Excel 文件。
"""

from pymongo import MongoClient
import openpyxl
from datetime import datetime

# MongoDB 连接配置
REPLICA_SET_HOSTS = "10.80.131.27:27017,10.80.131.38:27017,10.80.131.29:27017,10.80.131.41:27017"
USERNAME = "webuser"
PASSWORD = "Web010#Tom007"
AUTH_DB = "admin"
DB_NAME = "license"
COLLECTION_NAME = "productInfo"

# 构建连接 URI
uri = f"mongodb://{USERNAME}:{PASSWORD}@{REPLICA_SET_HOSTS}/{DB_NAME}?authSource={AUTH_DB}&readPreference=secondaryPreferred"

def main():
    # 连接 MongoDB
    print("正在连接 MongoDB...")
    client = MongoClient(
        uri,
        connectTimeoutMS=100000,
        socketTimeoutMS=150000,
        maxPoolSize=10,
        waitQueueTimeoutMS=150000,
    )

    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # 查询 status="01" 的数据，只取 productId 和 productName 字段
    print("正在查询 productInfo 表中 status=01 的数据...")
    cursor = collection.find(
        {"status": "01"},
        {"productId": 1, "productName": 1, "_id": 0}
    )

    results = list(cursor)
    print(f"查询到 {len(results)} 条记录")

    if not results:
        print("没有查询到数据，退出。")
        client.close()
        return

    # 创建 Excel 文件
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "productInfo"

    # 写入表头
    ws.append(["productId", "productName"])

    # 写入数据
    for row in results:
        ws.append([
            row.get("productId", ""),
            row.get("productName", ""),
        ])

    # 保存文件
    filename = f"product_info_status01_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    wb.save(filename)
    print(f"导出完成，文件：{filename}")

    client.close()

if __name__ == "__main__":
    main()
