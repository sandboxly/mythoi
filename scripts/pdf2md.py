import pymupdf4llm

def main():
    md = pymupdf4llm.to_markdown(
        'data/city_of_mist_players_guide.pdf'
    )
    print(md)

main()