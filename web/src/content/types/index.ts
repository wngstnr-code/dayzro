// Content types for the landing page.

export interface AudienceCard {
  id: number;
  title: string;
  points: string[];
}

export interface HomePageData {
  hero_title: string;
  about_suptitle: string;
  about_title: string;
  about_text: string;
  solution_screen_1_suptitle: string;
  solution_screen_1_title: string;
  solution_screen_2_title: string;
  solution_screen_2_text: string;
  solution_screen_3_title: string;
  solution_screen_3_text: string;
  solution_screen_4_title: string;
  solution_screen_4_text: string;
  governance_suptitle: string;
  governance_title: string;
  governance_text: string;
  audience_suptitle: string;
  audience_title: string;
  audience_list: AudienceCard[];
}
